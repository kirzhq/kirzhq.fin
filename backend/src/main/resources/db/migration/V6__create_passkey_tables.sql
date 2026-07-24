CREATE TABLE user_entities (
    id VARCHAR(128) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL
);

CREATE TABLE user_credentials (
    credential_id VARCHAR(1024) PRIMARY KEY,
    user_entity_user_id VARCHAR(128) NOT NULL REFERENCES user_entities(id) ON DELETE CASCADE,
    public_key BYTEA NOT NULL,
    signature_count BIGINT NOT NULL,
    uv_initialized BOOLEAN NOT NULL,
    backup_eligible BOOLEAN NOT NULL,
    authenticator_transports VARCHAR(255) NOT NULL,
    public_key_credential_type VARCHAR(32),
    backup_state BOOLEAN NOT NULL,
    attestation_object BYTEA,
    attestation_client_data_json BYTEA,
    created TIMESTAMP,
    last_used TIMESTAMP,
    label VARCHAR(255)
);

CREATE INDEX idx_user_credentials_user_id ON user_credentials (user_entity_user_id);
