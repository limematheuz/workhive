using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using OwnetTaskManager.DTOs.TaskItem;
using OwnetTaskManager.Interfaces;

namespace OwnetTaskManager.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TaskItemController : ControllerBase
    {
        private readonly ITaskItemRepository _taskItemRepository;
        private readonly IMapper _mapper;

        public TaskItemController(ITaskItemRepository taskItemRepository, IMapper mapper)
        {
            _taskItemRepository = taskItemRepository;
            _mapper = mapper;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<TaskItemDto>>> GetAllTaskItems()
        {
            var taskItems = await _taskItemRepository.GetAllTaskItemsAsync();
            return Ok(taskItems);
        }
        
        // [HttpGet("{id}")]
    }
}