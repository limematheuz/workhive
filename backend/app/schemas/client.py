from pydantic import BaseModel, EmailStr, ConfigDict


class ClientBase(BaseModel):
    name: str
    client_type: str = "individual"
    email: EmailStr | None = None
    phone: str | None = None
    address: str
    city: str
    province: str | None = None
    postal_code: str
    country: str
    legal_number: str | None = None
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class ClientCreate(ClientBase):
    company_id: int | None = None


class ClientUpdate(BaseModel):
    name: str | None = None
    client_type: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    province: str | None = None
    postal_code: str | None = None
    country: str | None = None
    legal_number: str | None = None
    is_active: bool | None = None


class ClientResponse(ClientBase):
    id: int
    company_id: int
