using AutoMapper;
using OwnetTaskManager.DTOs.Role;
using OwnetTaskManager.Models;

namespace OwnetTaskManager.Mappers;

public class RoleMapper : Profile
{
    public RoleMapper()
    {
        CreateMap<Role, RoleDto>();
        CreateMap<RoleDto, Role>();
        
        CreateMap<Role, RoleCreateDto>();
        CreateMap<RoleCreateDto, Role>();
        
        CreateMap<Role, RoleUpdateDto>();
        CreateMap<RoleUpdateDto, Role>();
    }
}