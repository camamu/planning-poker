export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['domain', 'app', 'infra', 'web', 'contracts', 'ci', 'docker', 'deps'],
    ],
  },
};
