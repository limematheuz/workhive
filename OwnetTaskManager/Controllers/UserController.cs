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
            try
            {
                var user = _mapper.Map<User>(userCreateDto);
                await _userRepository.CreateUserAsync(user);


                var userDto = _mapper.Map<UserDto>(user);
                return CreatedAtAction(nameof(GetUserById), new { id = user.Id }, userDto);
            }
            catch (Exception e)
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
    }
}

// Busca el usuario por su ID.
//     Si no se encuentra, devuelve un 404 Not Found.
//     Si el usuario existe, actualiza sus datos con los del DTO recibido.
//     Guarda los cambios en la base de datos.
//     Devuelve un 200 OK junto con los datos actualizados del usuario.