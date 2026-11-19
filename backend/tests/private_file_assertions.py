"""Inspect actual operating-system protection, rather than Windows mode bits."""

import ctypes
import os
import stat
from ctypes import wintypes
from pathlib import Path


def assert_owner_only(path: Path):
    if os.name != "nt":
        assert stat.S_IMODE(path.stat().st_mode) == 0o600
        return
    security = ctypes.WinDLL("advapi32", use_last_error=True)
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    pointer = ctypes.c_void_p
    kernel.LocalFree.argtypes = [pointer]
    kernel.LocalFree.restype = pointer
    security.GetNamedSecurityInfoW.argtypes = [wintypes.LPCWSTR, ctypes.c_int, wintypes.DWORD] + [ctypes.POINTER(pointer)] * 5
    security.GetNamedSecurityInfoW.restype = wintypes.DWORD
    security.GetSecurityDescriptorControl.argtypes = [pointer, ctypes.POINTER(wintypes.WORD), ctypes.POINTER(wintypes.DWORD)]
    security.GetSecurityDescriptorControl.restype = wintypes.BOOL
    security.GetAclInformation.argtypes = [pointer, pointer, wintypes.DWORD, ctypes.c_int]
    security.GetAclInformation.restype = wintypes.BOOL
    security.GetAce.argtypes = [pointer, wintypes.DWORD, ctypes.POINTER(pointer)]
    security.GetAce.restype = wintypes.BOOL
    security.EqualSid.argtypes = [pointer, pointer]
    security.EqualSid.restype = wintypes.BOOL

    class AclSize(ctypes.Structure):
        _fields_ = [("count", wintypes.DWORD), ("used", wintypes.DWORD), ("free", wintypes.DWORD)]

    class AceHeader(ctypes.Structure):
        _fields_ = [("kind", wintypes.BYTE), ("flags", wintypes.BYTE), ("size", wintypes.WORD)]

    owner, dacl, descriptor = pointer(), pointer(), pointer()
    try:
        result = security.GetNamedSecurityInfoW(str(path), 1, 5, ctypes.byref(owner), None, ctypes.byref(dacl), None, ctypes.byref(descriptor))
        assert result == 0
        assert owner.value and dacl.value
        control, revision = wintypes.WORD(), wintypes.DWORD()
        assert security.GetSecurityDescriptorControl(descriptor, ctypes.byref(control), ctypes.byref(revision))
        assert control.value & 0x1000  # SE_DACL_PROTECTED
        size, ace = AclSize(), pointer()
        assert security.GetAclInformation(dacl, ctypes.byref(size), ctypes.sizeof(size), 2)
        assert size.count == 1
        assert security.GetAce(dacl, 0, ctypes.byref(ace))
        header = ctypes.cast(ace, ctypes.POINTER(AceHeader)).contents
        assert header.kind == 0  # ACCESS_ALLOWED_ACE_TYPE
        assert header.flags == 0  # no inherited or inheritable entry
        assert wintypes.DWORD.from_address(ace.value + 4).value == 0x001F01FF  # FILE_ALL_ACCESS
        assert security.EqualSid(owner, pointer(ace.value + 8))
    finally:
        if descriptor:
            kernel.LocalFree(descriptor)
