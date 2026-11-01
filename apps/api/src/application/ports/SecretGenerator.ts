/**
 * Secretos que el usuario no elige: la clave con la que se firma cada webhook. A diferencia de
 * `IdGenerator`, lo que devuelve tiene que ser impredecible y de entropía suficiente para una clave.
 */
export interface SecretGenerator {
  generate(): string;
}
