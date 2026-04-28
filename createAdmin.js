require('dotenv').config();

const bcrypt = require('bcrypt');
const pool = require('./db');

async function criarAdmin() {
  console.log('Iniciando criação do admin...');

  const email = 'admin@email.com';
  const senha = '123456';

  console.log('Gerando hash da senha...');
  const senhaHash = await bcrypt.hash(senha, 10);

  console.log('Salvando no banco...');
  await pool.query(
    `INSERT INTO usuarios (email, senha_hash, nivel)
     VALUES ($1, $2, $3)`,
    [email, senhaHash, 'admin']
  );

  console.log('Admin criado com sucesso');
  console.log('Email:', email);
  console.log('Senha:', senha);

  await pool.end();
  process.exit(0);
}

criarAdmin().catch(async (erro) => {
  console.error('Erro ao criar admin:', erro.message);
  console.error(erro);

  await pool.end();
  process.exit(1);
});