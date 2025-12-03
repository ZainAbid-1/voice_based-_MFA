from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models

# Ensure tables exist
models.Base.metadata.create_all(bind=engine)

def promote_user_to_admin():
    db: Session = SessionLocal()
    
    username = input("Enter the username to promote to ADMIN: ")
    
    # Find the user
    user = db.query(models.User).filter(models.User.username == username).first()
    
    if not user:
        print(f"❌ User '{username}' not found. Please register them via the API first.")
        return

    # Update role
    if user.role == "admin":
        print(f"⚠️ User '{username}' is already an admin.")
    else:
        user.role = "admin"
        db.commit()
        print(f"✅ Success! User '{username}' is now an ADMIN.")
        print("They can now access endpoints like /admin/assign_task")

    db.close()

if __name__ == "__main__":
    promote_user_to_admin()