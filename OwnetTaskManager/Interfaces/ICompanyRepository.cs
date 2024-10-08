using OwnetTaskManager.Models;

namespace OwnetTaskManager.Interfaces;

public interface ICompanyRepository
{
    Task<IEnumerable<Company>> GetAllCompaniesAsync();
    Task<Company> GetCompanyByIdAsync(int id);
    Task<Company> CreateCompanyAsync(Company company);
    Task<Company> UpdateCompanyAsync(Company company);
    Task DeleteCompanyAsync(int id);
    Task ExistCompanyAsync(int id);
}