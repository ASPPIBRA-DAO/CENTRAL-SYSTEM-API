-- Adiciona as colunas que faltam na tabela users
ALTER TABLE users ADD COLUMN firstName TEXT;
ALTER TABLE users ADD COLUMN lastName TEXT;
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'citizen';