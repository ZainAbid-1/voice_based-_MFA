from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Format: mysql+pymysql://username:password@host:port/databasename
# REPLACE 'root' with your username
# REPLACE 'YOUR_PASSWORD_HERE' with your actual MySQL password
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:zainA42342@localhost/voice_mfa"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL
    # Note: We removed connect_args={"check_same_thread": False} because that is only for SQLite
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()