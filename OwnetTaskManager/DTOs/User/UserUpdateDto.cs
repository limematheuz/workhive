using System.ComponentModel.DataAnnotations;

namespace OwnetTaskManager.DTOs.User;

public class UserUpdateDto
{
    [Required(ErrorMessage = "Username is required")]
    [StringLength(50, MinimumLength = 3, ErrorMessage = "Username must be between 3 and 50 characters")]
    public string Username { get; set; }

    [Required(ErrorMessage = "CompanyId is required")]
    public int CompanyId { get; set; } // Relación con la empresa

    [Required(ErrorMessage = "CompanyName is required")]
    [StringLength(100, ErrorMessage = "CompanyName cannot exceed 100 characters")]
    public string CompanyName { get; set; } // Nombre de la empresa

    [Required(ErrorMessage = "RoleId is required")]
    public int RoleId { get; set; } // Relación con el rol

    [Required(ErrorMessage = "RoleName is required")]
    [StringLength(50, ErrorMessage = "RoleName cannot exceed 50 characters")]
    public string RoleName { get; set; } // Nombre del rol
}