from typing import Annotated

from fastapi import Query


PaginationOffset = Annotated[int, Query(ge=0)]
PaginationLimit = Annotated[int, Query(ge=1, le=500)]
