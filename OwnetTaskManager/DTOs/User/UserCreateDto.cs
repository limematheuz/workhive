using System.ComponentModel.DataAnnotations;

namespace OwnetTaskManager.DTOs.User;

public class UserCreateDto
{
    [Required(ErrorMessage = "Username is required")]
    [StringLength(50, MinimumLength = 3, ErrorMessage = "Username must be between 3 and 50 characters")]
    public string Username { get; set; }

    [Required(ErrorMessage = "Password is required")]
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters")]
    public string PasswordHash { get; set; }

    [Required(ErrorMessage = "CompanyId is required")]
    public int CompanyId { get; set; }

    [Required(ErrorMessage = "RoleId is required")]
    public int RoleId { get; set; }
}


