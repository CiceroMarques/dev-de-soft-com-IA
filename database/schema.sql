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
