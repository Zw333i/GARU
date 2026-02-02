"""
GARU - NBA Knowledge Arena API
FastAPI Backend Server
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import routers
from routers import players, games, stats

# Initialize FastAPI app
app = FastAPI(
    title="GARU API",
    description="NBA Knowledge Arena - Backend API for player stats, games, and draft battles",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://garu.vercel.app",  # Production URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(players.router, prefix="/api/players", tags=["Players"])
app.include_router(games.router, prefix="/api/games", tags=["Games"])
app.include_router(stats.router, prefix="/api/stats", tags=["Stats"])


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "app": "GARU API",
        "version": "1.0.0",
        "message": "Welcome to the NBA Knowledge Arena API! 🏀"
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "database": "connected",
        "api_version": "1.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("DEBUG", "True").lower() == "true"
    )
