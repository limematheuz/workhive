using AutoMapper;
using OwnetTaskManager.DTOs.Location;
using OwnetTaskManager.Models;

namespace OwnetTaskManager.Mappers;

public class LocationMapper : Profile
{
    public LocationMapper()
    {
        CreateMap<Location, LocationDto>();
        CreateMap<LocationDto, Location>();
        
        CreateMap<Location, LocationCreateDto>();
        CreateMap<LocationCreateDto, Location>();
        
        CreateMap<Location, LocationUpdateDto>();
        CreateMap<LocationUpdateDto, Location>();
    }
}