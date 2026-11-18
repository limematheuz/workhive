from pydantic import BaseModel, ConfigDict, Field, model_validator


class ClientPortalQuoteAccept(BaseModel):
    expected_revision: int = Field(ge=1, strict=True)
    confirmed: bool = Field(strict=True)

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def explicit_confirmation(self):
        if not self.confirmed:
            raise ValueError("Confirma expresamente los servicios y condiciones de esta revisión.")
        return self
