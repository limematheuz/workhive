using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using OwnetTaskManager.DTOs.User;
using OwnetTaskManager.Interfaces;
using OwnetTaskManager.Models;

namespace OwnetTaskManager.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserController : ControllerBase
    {
        private readonly IUserRepository _userRepository;
        private readonly IMapper _mapper;

        public UserController(IUserRepository userRepository, IMapper mapper)
        {
            _userRepository = userRepository;
            _mapper = mapper;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<UserDto>>> GetAllUsers()
        {
            var users = await _userRepository.GetAllUsersAsync();
            return Ok(users);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<IEnumerable<UserDto>>> GetUserById(int id)
        {
            var user = await _userRepository.GetUserByIdAsync(id);
            if (user == null)
            {
                return NotFound();
            }

            return Ok(user);
        }

        [HttpPost]
        public async Task<ActionResult<UserDto>> CreateUser([FromBody] UserCreateDto userCreateDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var user = _mapper.Map<User>(userCreateDto);
                await _userRepository.CreateUserAsync(user);

                var userDto = _mapper.Map<UserDto>(user);
                return CreatedAtAction(nameof(GetUserById), new { id = user.Id }, userDto);
            }
            catch (Exception)
            {
                return StatusCode(500, "Ocurrió un error al crear el usuario.");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<UserDto>> UpdateUserAsync([FromBody] UserUpdateDto userUpdateDto, int id)
        {
            var user = await _userRepository.GetUserByIdAsync(id);
            if (user == null)
            {
                return NotFound();
            }

            _mapper.Map(userUpdateDto, user);
            await _userRepository.UpdateUserAsync(user);

            var userDto = _mapper.Map<UserDto>(user);
            return Ok(userDto);
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<UserDto>> DeleteUserAsync(int id)
        {
            try
            {
                var user = await _userRepository.GetUserByIdAsync(id);
                if (user == null)
                {
                    return NotFound();
                }

                await _userRepository.DeleteUserAsync(user.Id);
                return Ok(user);
            }
            catch (Exception)
            {
                return StatusCode(500, "Ocurrió un error al eliminar el usuario.");
            }
        }
    }
}