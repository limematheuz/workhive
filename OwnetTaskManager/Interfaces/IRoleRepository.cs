using OwnetTaskManager.Models;

namespace OwnetTaskManager.Interfaces;

public interface IRoleRepository
{
    Task<IEnumerable<Role>> GetAllRolesAsync();
    Task<Role> GetRoleByIdAsync(int id);
    Task AddRoleAsync(Role role);
    Task UpdateRoleAsync(Role role);
    Task DeleteRoleAsync(int id);
    Task ExistRoleAsync(int id);
}