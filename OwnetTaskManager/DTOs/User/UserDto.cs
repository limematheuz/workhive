using System.ComponentModel.DataAnnotations;

namespace OwnetTaskManager.DTOs.User
{
    public class UserDto
    {
        [Required(ErrorMessage = "Username is required")]
        [StringLength(50, MinimumLength = 3, ErrorMessage = "Username must be between 3 and 50 characters")]
        public string Username { get; set; }

        public string CompanyName { get; set; } // Nombre de la empresa

        public string RoleName { get; set; } // Nombre del rol
    }
}