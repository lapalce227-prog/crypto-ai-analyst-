from fastapi import APIRouter, HTTPException, Depends
from app.models.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.services.auth_service import hash_password, verify_password, create_token, get_current_user
from app.services.user_store import user_store

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
async def register(req: UserCreate):
    if user_store.get_by_username(req.username):
        raise HTTPException(400, "用户名已存在")
    hashed = hash_password(req.password)
    user = user_store.create(req.username, hashed)
    token = create_token(user["id"], user["username"])
    return TokenResponse(access_token=token, user=UserResponse(**user))


@router.post("/login", response_model=TokenResponse)
async def login(req: UserLogin):
    u = user_store.get_by_username(req.username)
    if not u or not verify_password(req.password, u["hashed_password"]):
        raise HTTPException(401, "用户名或密码错误")
    token = create_token(u["id"], u["username"])
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=u["id"], username=u["username"], created_at=u["created_at"]),
    )


@router.get("/me", response_model=UserResponse)
async def me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        username=user["username"],
        created_at=user["created_at"],
    )
