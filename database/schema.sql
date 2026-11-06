CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash CHAR(60) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_email (email)
);

CREATE TABLE IF NOT EXISTS salas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(120) NOT NULL,
  andar INT NOT NULL,
  capacidade INT UNSIGNED NOT NULL,
  recursos JSON NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT chk_salas_capacidade CHECK (capacidade > 0),
  CONSTRAINT chk_salas_recursos_array CHECK (JSON_TYPE(recursos) = 'ARRAY')
);

CREATE TABLE IF NOT EXISTS reservas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sala_id INT UNSIGNED NOT NULL,
  data DATE NOT NULL,
  inicio TIME NOT NULL,
  fim TIME NOT NULL,
  responsavel VARCHAR(120) NOT NULL,
  finalidade VARCHAR(500) NOT NULL,
  situacao ENUM('Pendente', 'Aprovada', 'Cancelada') NOT NULL DEFAULT 'Pendente',
  PRIMARY KEY (id),
  INDEX idx_reservas_sala_data (sala_id, data, inicio),
  CONSTRAINT chk_reservas_horario CHECK (fim > inicio),
  CONSTRAINT fk_reservas_salas FOREIGN KEY (sala_id)
    REFERENCES salas (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_password_reset_token_hash (token_hash),
  INDEX idx_password_reset_user_active (user_id, consumed_at, expires_at),
  CONSTRAINT fk_password_reset_users FOREIGN KEY (user_id)
    REFERENCES usuarios (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);
