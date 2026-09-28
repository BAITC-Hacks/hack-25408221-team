from fastapi import HTTPException, status


class ValidationFailure(HTTPException):
    """422 with a list of {field, code} problems, per Module 1's field-rule contract."""

    def __init__(self, problems: list[dict]):
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=problems)


def not_found(what: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{what}_not_found")


def conflict(code: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=code)
