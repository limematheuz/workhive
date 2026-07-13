import sys
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# IMPORTANTE: Le enseñamos a python dónde encontrar tu carpeta 'app'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Importamos la configuración local y nuestros Modelos de Base de Datos
from app.core.config import settings
from app.db.base import Base

# Lector de configuración de Alembic
config = context.config

# Sobrescribimos en caliente la URL de la BD desde nuestras variables de entorno (.env)
config.set_main_option("sqlalchemy.url", settings.migration_database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

# Aquí le pasamos el "molde" con todos los Modelos para que Alembic sepa qué crear
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
