using AutoMapper;
using OwnetTaskManager.DTOs.Company;
using OwnetTaskManager.Models;

namespace OwnetTaskManager.Mappers;

public class CompanyMapper : Profile
{
    public CompanyMapper()
    {
        CreateMap<Company, CompanyDto>();
        CreateMap<CompanyDto, Company>();
        
        CreateMap<Company, CompanyCreateDto>();
        CreateMap<CompanyCreateDto, Company>();
        
        CreateMap<Company, CompanyUpdateDto>();
        CreateMap<CompanyUpdateDto, Company>();
    }
}