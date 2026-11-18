"""Apply owner-only file protection before private material is written."""

import ctypes
import os
from ctypes import wintypes
from pathlib import Path


def restrict_to_owner(path: Path) -> None:
    if os.name == "nt":
        _windows_owner_acl(path)
    else:
        path.chmod(0o600)


def _windows_owner_acl(path: Path) -> None:
    # Windows chmod only controls the read-only attribute. Use a protected DACL
    # with one explicit process-user SID instead of inheriting directory groups.
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    security = ctypes.WinDLL("advapi32", use_last_error=True)
    pointer = ctypes.c_void_p
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    kernel.GetCurrentProcess.argtypes = []
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.CloseHandle.restype = wintypes.BOOL
    kernel.LocalFree.argtypes = [pointer]
    kernel.LocalFree.restype = pointer
    security.OpenProcessToken.argtypes = [wintypes.HANDLE, wintypes.DWORD, ctypes.POINTER(wintypes.HANDLE)]
    security.OpenProcessToken.restype = wintypes.BOOL
    security.GetTokenInformation.argtypes = [wintypes.HANDLE, ctypes.c_int, pointer, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
    security.GetTokenInformation.restype = wintypes.BOOL
    security.ConvertSidToStringSidW.argtypes = [pointer, ctypes.POINTER(wintypes.LPWSTR)]
    security.ConvertSidToStringSidW.restype = wintypes.BOOL
    security.ConvertStringSecurityDescriptorToSecurityDescriptorW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, ctypes.POINTER(pointer), ctypes.POINTER(wintypes.DWORD)]
    security.ConvertStringSecurityDescriptorToSecurityDescriptorW.restype = wintypes.BOOL
    security.GetSecurityDescriptorDacl.argtypes = [pointer, ctypes.POINTER(wintypes.BOOL), ctypes.POINTER(pointer), ctypes.POINTER(wintypes.BOOL)]
    security.GetSecurityDescriptorDacl.restype = wintypes.BOOL
    security.SetNamedSecurityInfoW.argtypes = [wintypes.LPWSTR, ctypes.c_int, wintypes.DWORD, pointer, pointer, pointer, pointer]
    security.SetNamedSecurityInfoW.restype = wintypes.DWORD

    class TokenUser(ctypes.Structure):
        _fields_ = [("sid", pointer), ("attributes", wintypes.DWORD)]

    token = wintypes.HANDLE()
    descriptor = pointer()
    sid_string = wintypes.LPWSTR()
    try:
        if not security.OpenProcessToken(kernel.GetCurrentProcess(), 0x0008, ctypes.byref(token)):
            raise ctypes.WinError(ctypes.get_last_error())
        required = wintypes.DWORD()
        security.GetTokenInformation(token, 1, None, 0, ctypes.byref(required))
        if not required.value:
            raise ctypes.WinError(ctypes.get_last_error())
        identity = ctypes.create_string_buffer(required.value)
        if not security.GetTokenInformation(token, 1, identity, required, ctypes.byref(required)):
            raise ctypes.WinError(ctypes.get_last_error())
        user_sid = ctypes.cast(identity, ctypes.POINTER(TokenUser)).contents.sid
        if not security.ConvertSidToStringSidW(user_sid, ctypes.byref(sid_string)):
            raise ctypes.WinError(ctypes.get_last_error())
        sddl = f"D:P(A;;FA;;;{sid_string.value})"
        if not security.ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl, 1, ctypes.byref(descriptor), None):
            raise ctypes.WinError(ctypes.get_last_error())
        present, defaulted, dacl = wintypes.BOOL(), wintypes.BOOL(), pointer()
        if not security.GetSecurityDescriptorDacl(descriptor, ctypes.byref(present), ctypes.byref(dacl), ctypes.byref(defaulted)) or not present.value or not dacl.value:
            raise OSError("An explicit private file DACL could not be constructed")
        # OWNER + DACL + PROTECTED_DACL. Set the owner to that same process user
        # so owner rights cannot accidentally refer to an inherited group owner.
        result = security.SetNamedSecurityInfoW(str(path), 1, 0x80000005, user_sid, None, dacl, None)
        if result:
            raise ctypes.WinError(result)
    finally:
        if sid_string:
            kernel.LocalFree(ctypes.cast(sid_string, pointer))
        if descriptor:
            kernel.LocalFree(descriptor)
        if token:
            kernel.CloseHandle(token)
