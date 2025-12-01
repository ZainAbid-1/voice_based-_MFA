from database import engine
from sqlalchemy import text

def reset_database():
    print("🔌 Connecting to MySQL database...")
    
    with engine.connect() as connection:
        try:
            # 1. Disable Foreign Key Checks (Crucial for MySQL)
            # This allows us to delete the 'users' table even if 'tasks' depends on it.
            print("🔓 Disabling Foreign Key Checks...")
            connection.execute(text("SET FOREIGN_KEY_CHECKS = 0"))

            # 2. List of tables to drop (Order doesn't matter now)
            tables = ["tasks", "attendance", "login_attempts", "challenges", "users"]

            print("🗑️  Dropping tables...")
            for table in tables:
                connection.execute(text(f"DROP TABLE IF EXISTS {table}"))
                print(f"   - Dropped table: {table}")

            # 3. Re-enable Foreign Key Checks
            print("🔒 Re-enabling Foreign Key Checks...")
            connection.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
            
            connection.commit()
            print("\n✅ Database cleared successfully!")
            print("👉 Now run: uvicorn main:app --reload")
            
        except Exception as e:
            print(f"\n❌ Error resetting database: {e}")

if __name__ == "__main__":
    reset_database()