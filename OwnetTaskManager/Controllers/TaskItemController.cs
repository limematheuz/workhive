using AutoMapper;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using OwnetTaskManager.DTOs.TaskItem;
using OwnetTaskManager.Interfaces;
using OwnetTaskManager.Models;

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

        [HttpGet("{id}")]
        public async Task<ActionResult<IEnumerable<TaskItemDto>>> GetTaskItemById(int id)
        {
            var taskItem = await _taskItemRepository.GetTaskItemByIdAsync(id);
            if (taskItem == null)
            {
                return NotFound();
            }

            return Ok(taskItem);
        }

        [HttpPost]
        public async Task<ActionResult<TaskItemDto>> CreateTaskItem([FromBody] TaskItemCreateDto taskItemCreateDto)
        {
            if (!ModelState.IsValid)
            {
                // Retorna errores de validación sin tocar la base de datos
                return BadRequest(ModelState);
            }

            try
            {
                var taskItem = _mapper.Map<TaskItem>(taskItemCreateDto);
                await _taskItemRepository.CreateTaskItemAsync(taskItem);

                var taskItemDto = _mapper.Map<TaskItemDto>(taskItem);
                return CreatedAtAction(nameof(GetTaskItemById), new { id = taskItem.Id }, taskItemDto);
            }
            catch (Exception)
            {
                return StatusCode(500, "Ocurrió un error al crear la tarea.");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<TaskItemDto>> UpdateTaskItemAsync([FromBody] TaskItemUpdateDto taskItemUpdateDto,
            int id)
        {
            var taskItem = await _taskItemRepository.GetTaskItemByIdAsync(id);
            if (taskItem == null)
            {
                return NotFound();
            }

            _mapper.Map(taskItemUpdateDto, taskItem);
            await _taskItemRepository.UpdateTaskItemAsync(taskItem);

            var taskItemDto = _mapper.Map<TaskItemDto>(taskItem);
            return Ok(taskItemDto);
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<TaskItemDto>> DeleteTaskItemAsync(int id)
        {
            try
            {
                var taskItem = await _taskItemRepository.GetTaskItemByIdAsync(id);
                if (taskItem == null)
                {
                    return NotFound();
                }

                await _taskItemRepository.DeleteTaskItemAsync(taskItem.Id);
                return Ok(taskItem);
            }
            catch (Exception)
            {
                return StatusCode(500, "Ocurrió un error al eliminar la tarea.");
            }
        }
    }
}