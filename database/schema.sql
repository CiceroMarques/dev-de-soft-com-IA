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
