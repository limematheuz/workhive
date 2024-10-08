using OwnetTaskManager.Models;

namespace OwnetTaskManager.Interfaces;

public interface ITaskItemRepository
{
    Task<IEnumerable<TaskItem>> GetAllTaskItemsAsync();
    Task<TaskItem> GetTaskItemByIdAsync(int id);
    Task<TaskItem> CreateTaskItemAsync(TaskItem taskItem);
    Task<TaskItem> UpdateTaskItemAsync(TaskItem taskItem);
    Task DeleteTaskItemAsync(int id);
    Task ExistTaskItemAsync(int id);
}