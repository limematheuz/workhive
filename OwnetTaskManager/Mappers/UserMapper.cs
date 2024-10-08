using AutoMapper;
using OwnetTaskManager.DTOs.User;
using OwnetTaskManager.Models;

namespace OwnetTaskManager.Mappers;

public class UserMapper : Profile
{
    public UserMapper()
    {
        CreateMap<User, UserDto>();
        CreateMap<UserDto, User>();

        CreateMap<User, UserCreateDto>();
        CreateMap<UserCreateDto, User>();

        CreateMap<User, UserUpdateDto>();
        CreateMap<UserUpdateDto, User>();
    }
}