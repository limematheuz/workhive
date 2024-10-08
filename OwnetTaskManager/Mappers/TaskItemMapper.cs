using AutoMapper;
using OwnetTaskManager.DTOs.TaskItem;
using OwnetTaskManager.Models;

namespace OwnetTaskManager.Mappers;

public class TaskItemMapper : Profile
{
    public TaskItemMapper()
    {
        CreateMap<TaskItem, TaskItemDto>();
        CreateMap<TaskItemDto, TaskItem>();

        CreateMap<TaskItem, TaskItemCreateDto>();
        CreateMap<TaskItemCreateDto, TaskItem>();

        CreateMap<TaskItem, TaskItemUpdateDto>();
        CreateMap<TaskItemUpdateDto, TaskItem>();
    }
}