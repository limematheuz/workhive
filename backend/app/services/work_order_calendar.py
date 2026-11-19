"""Calendar arithmetic shared by finite plans and recurring execution."""
from calendar import monthrange
from datetime import timedelta


def next_occurrence(current,unit,interval):
    if unit=="weekly":return current+timedelta(weeks=interval or 1)
    month=current.month-1+(interval or 1)
    year=current.year+month//12
    month=month%12+1
    return current.replace(year=year,month=month,day=min(current.day,monthrange(year,month)[1]))
