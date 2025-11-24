from database import engine
import models

print("Connecting to database...")
print("Creating tables...")

# This command forces SQLAlchemy to create the 'users' table in MySQL
models.Base.metadata.create_all(bind=engine)

print("Success! Tables created.")