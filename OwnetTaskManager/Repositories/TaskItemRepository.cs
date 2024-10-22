using Microsoft.EntityFrameworkCore;
using OwnetTaskManager.Data;
using OwnetTaskManager.Interfaces;
using OwnetTaskManager.Models;

namespace OwnetTaskManager.Repositories;

public class TaskItemRepository : ITaskItemRepository
{
    private readonly AppDbContext _context;

    public TaskItemRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<TaskItem>> GetAllTaskItemsAsync()
    {
        return await _context.TaskItems
            .Include(t => t.User)
            .Include(u => u.Company)
            .Include(t => t.Location)
            .ToListAsync();
    }

    public async Task<TaskItem?> GetTaskItemByIdAsync(int id)
    {
        return await _context.TaskItems
            .Include(t => t.User)
            .Include(u => u.Company)
            .Include(t => t.Location)
            .FirstOrDefaultAsync(t => t.Id == id);
    }

    public async Task<TaskItem> CreateTaskItemAsync(TaskItem taskItem)
    {
        await _context.AddAsync(taskItem);
        await _context.SaveChangesAsync();
        return taskItem;
    }

    public async Task<TaskItem> UpdateTaskItemAsync(TaskItem taskItem)
    {
        _context.Update(taskItem);
        await _context.SaveChangesAsync();
        return taskItem;
    }

    public async Task DeleteTaskItemAsync(int id)
    {
        var taskItem = await GetTaskItemByIdAsync(id);
        if (taskItem != null)
        {
            _context.TaskItems.Remove(taskItem);
            await _context.SaveChangesAsync();
        }
    }

    public async Task<bool> ExistTaskItemAsync(int id)
    {
        return await _context.TaskItems.AnyAsync(t => t.Id == id);
    }
}