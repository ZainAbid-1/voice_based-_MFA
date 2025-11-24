from sqlalchemy import Column, Integer, String, LargeBinary
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True) # Added length 50
    password_hash = Column(String(255))                    # Added length 255
    salt = Column(String(255))                             # Added length 255
    
    # Use LargeBinary for BLOB storage (holds the encrypted voice vector)
    voiceprint = Column(LargeBinary(length=(2**32)-1))     # LongBlob to be safe