from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.routes import router as api_router
from app.api.auth import router as auth_router

app = FastAPI(title="Laplace Market", version="0.4.0")


@app.on_event("startup")
async def startup():
    from app.services.agent_graph import agent_graph
    from app.services.alert_service import alert_service
    # Pre-warm LangGraph agent
    try:
        await agent_graph.create_graph()
    except Exception:
        pass
    # Start background alert monitoring (60s intervals)
    await alert_service.start(interval_seconds=60)


@app.on_event("shutdown")
async def shutdown():
    from app.services.alert_service import alert_service
    await alert_service.stop()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth")
app.include_router(api_router, prefix="/api")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "服务器内部错误，请稍后重试"},
    )

@app.get("/")
async def root():
    return {"name": "Laplace Agent", "status": "running"}
