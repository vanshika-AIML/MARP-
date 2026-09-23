from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas
from database import get_db

router = APIRouter(prefix="/presentations", tags=["presentations"])

@router.get("", response_model=List[schemas.Presentation])
def list_presentations(db: Session = Depends(get_db)):
    return db.query(models.Presentation).all()

@router.get("/{id}", response_model=schemas.Presentation)
def get_presentation(id: str, db: Session = Depends(get_db)):
    db_presentation = db.query(models.Presentation).filter(models.Presentation.id == id).first()
    if db_presentation is None:
        raise HTTPException(status_code=404, detail="Presentation not found")
    return db_presentation

@router.post("", response_model=schemas.Presentation)
def create_presentation(presentation: schemas.PresentationCreate, db: Session = Depends(get_db)):
    db_presentation = models.Presentation(**presentation.model_dump())
    db.add(db_presentation)
    db.commit()
    db.refresh(db_presentation)
    return db_presentation

@router.put("/{id}", response_model=schemas.Presentation)
def update_presentation(id: str, presentation: schemas.PresentationUpdate, db: Session = Depends(get_db)):
    db_presentation = db.query(models.Presentation).filter(models.Presentation.id == id).first()
    if db_presentation is None:
        raise HTTPException(status_code=404, detail="Presentation not found")
    
    update_data = presentation.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_presentation, key, value)
        
    db.commit()
    db.refresh(db_presentation)
    return db_presentation

@router.delete("/{id}")
def delete_presentation(id: str, db: Session = Depends(get_db)):
    db_presentation = db.query(models.Presentation).filter(models.Presentation.id == id).first()
    if db_presentation is None:
        raise HTTPException(status_code=404, detail="Presentation not found")
    db.delete(db_presentation)
    db.commit()
    return {"message": "Presentation deleted"}

@router.post("/{id}/export")
def export_presentation(id: str, payload: dict, db: Session = Depends(get_db)):
    # Mocking export for now
    format = payload.get("format", "html")
    return {"message": f"Exported {id} to {format} (Mocked)"}
