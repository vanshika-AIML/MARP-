from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import presentations, agent, render, websockets

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="MARP Studio API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API v1 Router
api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(presentations.router)
api_v1_router.include_router(render.router)
api_v1_router.include_router(agent.router)

# Include the main routers
app.include_router(api_v1_router)

# Websockets router
app.include_router(websockets.router)

@app.get("/")
def read_root():
    return {"message": "MARP Studio API is running"}
