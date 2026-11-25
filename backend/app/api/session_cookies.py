from app.core.config import settings


def cookie_options():
    options={"secure":settings.is_production or settings.FORCE_HTTPS,"samesite":settings.SESSION_COOKIE_SAMESITE,"path":"/","max_age":settings.ACCESS_TOKEN_EXPIRE_MINUTES*60}
    if settings.SESSION_COOKIE_DOMAIN:options["domain"]=settings.SESSION_COOKIE_DOMAIN
    return options


def delete_cookie_options():
    options={"path":"/","secure":settings.is_production or settings.FORCE_HTTPS,"samesite":settings.SESSION_COOKIE_SAMESITE}
    if settings.SESSION_COOKIE_DOMAIN:options["domain"]=settings.SESSION_COOKIE_DOMAIN
    return options


def set_session_cookies(response,token,csrf,*,max_age=None):
    options=cookie_options()
    if max_age is not None:
        options["max_age"] = max_age
    response.set_cookie(key=settings.SESSION_COOKIE_NAME,value=token,httponly=True,**options)
    response.set_cookie(key=settings.CSRF_COOKIE_NAME,value=csrf,httponly=False,**options)
