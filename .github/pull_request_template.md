## O que muda / What changes

<!-- Uma ou duas frases: o problema e a solução. -->

## Como testar / How to test

<!-- Passos ou comandos. -->

## Checklist

- [ ] Testes escritos primeiro (commit `test:` antes do `feat:`) / tests written first
- [ ] `pnpm lint && pnpm typecheck && pnpm test:cov` passam
- [ ] Mudou tela? Conferi no celular (360 px) e os testes de acessibilidade passam
- [ ] Nenhum segredo, token ou dado real de cliente no diff
- [ ] Mudança de banco tem migration e foi testada com `pnpm --filter @mon-cher-savon/api test:int`
