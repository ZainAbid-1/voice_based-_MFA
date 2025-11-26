from database import engine
import models

print("=" * 50)
print("Database Initialization")
print("=" * 50)

print("\nConnecting to database...")
print(f"Database URL: {engine.url}")

print("\nCreating tables...")
try:
    # This command creates all tables defined in models.py
    models.Base.metadata.create_all(bind=engine)
    print("\n✓ Tables created successfully!")
    
    # List all tables created
    print("\nTables created:")
    print("  - users (Main user accounts)")
    print("  - login_attempts (Authentication audit log)")
    print("  - challenges (Voice challenges)")
    
    print("\n" + "=" * 50)
    print("Database initialization complete!")
    print("=" * 50)
    
except Exception as e:
    print(f"\n✗ Error creating tables: {e}")
    print("\nPlease check:")
    print("  1. MySQL server is running")
    print("  2. Database credentials in .env are correct")
    print("  3. Database 'voice_mfa' exists")
    exit(1)