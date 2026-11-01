import type { CreatedWebhookView, WebhookView } from '@pp/contracts';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addWebhook,
  listWebhooks,
  removeWebhook,
  testWebhook,
} from '../../../shared/api/teamsClient.js';
import { WebhooksPanel } from './WebhooksPanel.js';

vi.mock('../../../shared/api/teamsClient.js', () => ({
  listWebhooks: vi.fn(),
  addWebhook: vi.fn(),
  removeWebhook: vi.fn(),
  testWebhook: vi.fn(),
}));

function webhook(id: string, overrides: Partial<WebhookView> = {}): WebhookView {
  return {
    id,
    url: `https://hooks.example/${id}`,
    events: ['issue.estimated'],
    secretHint: 'ab12',
    ...overrides,
  };
}

function renderPanel(): void {
  render(<WebhooksPanel slug="backend" token="tok" />);
}

async function openLoaded(webhooks: ReadonlyArray<WebhookView>): Promise<void> {
  vi.mocked(listWebhooks).mockResolvedValue(webhooks);
  renderPanel();
  await screen.findByText(/de 3$/);
}

function fillForm(url: string, events: ReadonlyArray<string>): void {
  fireEvent.change(screen.getByLabelText('URL del receptor'), { target: { value: url } });
  for (const event of events) fireEvent.click(screen.getByRole('checkbox', { name: event }));
}

describe('WebhooksPanel', () => {
  beforeEach(() => {
    vi.mocked(listWebhooks).mockReset();
    vi.mocked(addWebhook).mockReset();
    vi.mocked(removeWebhook).mockReset();
    vi.mocked(testWebhook).mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('lista cada webhook con su URL, sus eventos y solo el final de su secreto', async () => {
    await openLoaded([
      webhook('a', { events: ['issue.estimated', 'session.summary'], secretHint: 'f00d' }),
    ]);

    const row = screen.getByRole('listitem');
    expect(within(row).getByText('https://hooks.example/a')).toBeInTheDocument();
    expect(within(row).getByText('Tarea estimada')).toBeInTheDocument();
    expect(within(row).getByText('Resumen de sesión')).toBeInTheDocument();
    expect(within(row).getByText('Secreto: …f00d')).toBeInTheDocument();
    expect(screen.getByText('1 de 3')).toBeInTheDocument();
  });

  it('avisa de que todavía no hay webhooks', async () => {
    await openLoaded([]);

    expect(screen.getByText('Todavía no hay webhooks.')).toBeInTheDocument();
  });

  it('muestra el error si no se pueden cargar', async () => {
    vi.mocked(listWebhooks).mockRejectedValue(new Error('No existe el equipo backend.'));

    renderPanel();

    expect(await screen.findByRole('alert')).toHaveTextContent('No existe el equipo backend.');
  });

  it('no deja añadir sin URL o sin ningún evento', async () => {
    await openLoaded([]);
    const add = screen.getByRole('button', { name: 'Añadir webhook' });
    expect(add).toBeDisabled();

    fillForm('https://hooks.example/nuevo', []);
    expect(add).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Tarea estimada' }));
    expect(add).toBeEnabled();
  });

  it('el alta manda la URL y los eventos elegidos y enseña el secreto completo una vez', async () => {
    await openLoaded([]);
    const created: CreatedWebhookView = {
      ...webhook('nuevo', { events: ['issue.estimated', 'session.summary'] }),
      secret: 'secreto-completo-de-64-caracteres',
    };
    vi.mocked(addWebhook).mockResolvedValue(created);
    vi.mocked(listWebhooks).mockResolvedValue([webhook('nuevo')]);
    fillForm('  https://hooks.example/nuevo ', ['Resumen de sesión', 'Tarea estimada']);

    fireEvent.click(screen.getByRole('button', { name: 'Añadir webhook' }));

    expect(await screen.findByText('secreto-completo-de-64-caracteres')).toBeInTheDocument();
    expect(addWebhook).toHaveBeenCalledWith('backend', 'tok', {
      url: 'https://hooks.example/nuevo',
      events: ['issue.estimated', 'session.summary'],
    });
    expect(await screen.findByText('https://hooks.example/nuevo')).toBeInTheDocument();
    expect(screen.getByLabelText('URL del receptor')).toHaveValue('');
  });

  it('el secreto se oculta al confirmar que se ha guardado', async () => {
    await openLoaded([]);
    vi.mocked(addWebhook).mockResolvedValue({ ...webhook('n'), secret: 'secreto-visible' });
    vi.mocked(listWebhooks).mockResolvedValue([webhook('n')]);
    fillForm('https://hooks.example/n', ['Tarea estimada']);
    fireEvent.click(screen.getByRole('button', { name: 'Añadir webhook' }));
    await screen.findByText('secreto-visible');

    fireEvent.click(screen.getByRole('button', { name: 'Ya lo he guardado' }));

    expect(screen.queryByText('secreto-visible')).not.toBeInTheDocument();
  });

  it('copia el secreto al portapapeles y lo confirma', async () => {
    await openLoaded([]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    vi.mocked(addWebhook).mockResolvedValue({ ...webhook('n'), secret: 'secreto-a-copiar' });
    vi.mocked(listWebhooks).mockResolvedValue([webhook('n')]);
    fillForm('https://hooks.example/n', ['Tarea estimada']);
    fireEvent.click(screen.getByRole('button', { name: 'Añadir webhook' }));
    await screen.findByText('secreto-a-copiar');

    fireEvent.click(screen.getByRole('button', { name: 'Copiar secreto' }));

    expect(await screen.findByRole('button', { name: 'Copiado ✓' })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith('secreto-a-copiar');
  });

  it('avisa si el navegador no deja copiar el secreto', async () => {
    await openLoaded([]);
    vi.stubGlobal('navigator', {});
    vi.mocked(addWebhook).mockResolvedValue({ ...webhook('n'), secret: 'secreto-a-copiar' });
    vi.mocked(listWebhooks).mockResolvedValue([webhook('n')]);
    fillForm('https://hooks.example/n', ['Tarea estimada']);
    fireEvent.click(screen.getByRole('button', { name: 'Añadir webhook' }));
    await screen.findByText('secreto-a-copiar');

    fireEvent.click(screen.getByRole('button', { name: 'Copiar secreto' }));

    expect(await screen.findByText(/No se pudo copiar/)).toBeInTheDocument();
  });

  it('si el servidor rechaza el alta enseña el motivo y conserva lo escrito', async () => {
    await openLoaded([]);
    vi.mocked(addWebhook).mockRejectedValue(new Error('"http://x" no es https.'));
    fillForm('http://x', ['Tarea estimada']);

    fireEvent.click(screen.getByRole('button', { name: 'Añadir webhook' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('no es https');
    expect(screen.getByLabelText('URL del receptor')).toHaveValue('http://x');
    expect(screen.getByRole('checkbox', { name: 'Tarea estimada' })).toBeChecked();
  });

  it('con tres webhooks no deja añadir otro y lo explica', async () => {
    await openLoaded([webhook('a'), webhook('b'), webhook('c')]);

    expect(screen.getByText('3 de 3')).toBeInTheDocument();
    expect(screen.getByText(/hasta 3 webhooks/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Añadir webhook' })).toBeDisabled();
    expect(screen.getByLabelText('URL del receptor')).toBeDisabled();
  });

  it('«Enviar prueba» enseña el código con el que contestó el receptor', async () => {
    await openLoaded([webhook('a')]);
    vi.mocked(testWebhook).mockResolvedValue({ ok: true, status: 200, error: null });

    fireEvent.click(
      screen.getByRole('button', { name: 'Enviar prueba a https://hooks.example/a' }),
    );

    expect(await screen.findByText('El receptor contestó HTTP 200.')).toBeInTheDocument();
    expect(testWebhook).toHaveBeenCalledWith('backend', 'tok', 'a');
  });

  it('«Enviar prueba» enseña por qué no llegó', async () => {
    await openLoaded([webhook('a')]);
    vi.mocked(testWebhook).mockResolvedValue({ ok: false, status: 503, error: 'HTTP 503' });

    fireEvent.click(
      screen.getByRole('button', { name: 'Enviar prueba a https://hooks.example/a' }),
    );

    expect(await screen.findByText('No llegó: HTTP 503.')).toBeInTheDocument();
  });

  it('«Enviar prueba» enseña el error si la petición a la API falla', async () => {
    await openLoaded([webhook('a')]);
    vi.mocked(testWebhook).mockRejectedValue(new Error('Error 500 al llamar a la API'));

    fireEvent.click(
      screen.getByRole('button', { name: 'Enviar prueba a https://hooks.example/a' }),
    );

    expect(await screen.findByText('Error 500 al llamar a la API')).toBeInTheDocument();
  });

  it('el resultado de una prueba va en la fila de su webhook y no en las demás', async () => {
    await openLoaded([webhook('a'), webhook('b')]);
    vi.mocked(testWebhook).mockResolvedValue({ ok: true, status: 204, error: null });

    fireEvent.click(
      screen.getByRole('button', { name: 'Enviar prueba a https://hooks.example/b' }),
    );

    const [first, second] = screen.getAllByRole('listitem');
    if (!first || !second) throw new Error('faltan filas');
    expect(await within(second).findByText('El receptor contestó HTTP 204.')).toBeInTheDocument();
    expect(within(first).queryByRole('status')).not.toBeInTheDocument();
  });

  it('borrar pide confirmación y refresca la lista', async () => {
    await openLoaded([webhook('a'), webhook('b')]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(removeWebhook).mockResolvedValue(undefined);
    vi.mocked(listWebhooks).mockResolvedValue([webhook('b')]);

    fireEvent.click(screen.getByRole('button', { name: 'Borrar https://hooks.example/a' }));

    await waitFor(() => {
      expect(screen.queryByText('https://hooks.example/a')).not.toBeInTheDocument();
    });
    expect(removeWebhook).toHaveBeenCalledWith('backend', 'tok', 'a');
    expect(screen.getByText('https://hooks.example/b')).toBeInTheDocument();
  });

  it('si se cancela la confirmación no se borra nada', async () => {
    await openLoaded([webhook('a')]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    fireEvent.click(screen.getByRole('button', { name: 'Borrar https://hooks.example/a' }));

    expect(removeWebhook).not.toHaveBeenCalled();
    expect(screen.getByText('https://hooks.example/a')).toBeInTheDocument();
  });

  it('si borrar falla enseña el motivo y deja el webhook donde estaba', async () => {
    await openLoaded([webhook('a')]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(removeWebhook).mockRejectedValue(new Error('No existe el webhook a en este equipo.'));

    fireEvent.click(screen.getByRole('button', { name: 'Borrar https://hooks.example/a' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No existe el webhook a');
    expect(screen.getByText('https://hooks.example/a')).toBeInTheDocument();
  });
});
