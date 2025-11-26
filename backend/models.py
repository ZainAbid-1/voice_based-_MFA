from sqlalchemy import Column, Integer, String, LargeBinary, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    salt = Column(String(255), nullable=False)
    voiceprint = Column(LargeBinary(length=(2**32)-1), nullable=False)
    
    # Security fields
    failed_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    last_login = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)

class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    username = Column(String(50), nullable=False, index=True)
    success = Column(Boolean, nullable=False)
    failure_reason = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)
    timestamp = Column(DateTime, server_default=func.now(), index=True)

class Challenge(Base):
    __tablename__ = "challenges"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), nullable=False, index=True)
    challenge_code = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), index=True)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)