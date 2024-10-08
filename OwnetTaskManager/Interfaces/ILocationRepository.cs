using OwnetTaskManager.Models;

namespace OwnetTaskManager.Interfaces;

public interface ILocationRepository
{
    Task<IEnumerable<Location>> GetAllLocationsAsync();
    Task<Location> GetLocationByIdAsync(int id);
    Task<Location> CreateLocationAsync(Location location);
    Task<Location> UpdateLocationAsync(Location location);
    Task DeleteLocationAsync(int id);
    Task ExistLocationAsync(int id);
}