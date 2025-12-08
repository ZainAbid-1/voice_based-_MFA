from sqlalchemy import Column, Integer, String, LargeBinary, DateTime, ForeignKey, Boolean, Float, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    salt = Column(String(255), nullable=False)
    voiceprint = Column(LargeBinary(length=(2**32)-1), nullable=False)
    
    # New Role Field (admin vs employee)
    role = Column(String(20), default="employee") 
    
    # Security fields
    failed_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    last_login = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)

    tasks = relationship("Task", back_populates="assigned_to")

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

# --- ATTENDANCE TRACKING ---
class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    username = Column(String(50), nullable=False)
    
    date = Column(DateTime, default=func.now()) # To group by day
    clock_in = Column(DateTime, default=func.now())
    clock_out = Column(DateTime, nullable=True)
    
    status = Column(String(50), default="Working") # Working, Completed, Left Early (Authorized), Left Early (Fined)
    fine_amount = Column(Float, default=0.0)

# --- TASK MANAGEMENT ---
class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    
    assigned_at = Column(DateTime, server_default=func.now())
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)

    assigned_to = relationship("User", back_populates="tasks")

class PendingRegistration(Base):
    __tablename__ = "pending_registrations"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="employee")
    
    sample_1_embedding = Column(LargeBinary, nullable=True)
    sample_2_embedding = Column(LargeBinary, nullable=True)
    sample_3_embedding = Column(LargeBinary, nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=False)