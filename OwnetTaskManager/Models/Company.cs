using System.ComponentModel.DataAnnotations;

namespace OwnetTaskManager.Models;

public class Company
{
    [Key]
    public int Id { get; set; }

    [Required(ErrorMessage = "The name is required")]
    [StringLength(100, ErrorMessage = "The name cannot exceed 100 characters")]
    public string Name { get; set; }

    [Phone(ErrorMessage = "Invalid phone number")]
    [StringLength(15, ErrorMessage = "The phone number cannot exceed 15 characters")]
    public string Phone { get; set; }

    [EmailAddress(ErrorMessage = "Invalid email address")]
    public string Email { get; set; }

    [Url(ErrorMessage = "Invalid website URL")]
    public string Website { get; set; }

    public string Logo { get; set; }

    [Required(ErrorMessage = "The status is required")]
    public string Status { get; set; }

    [Required]
    public string IsDeleted { get; set; } = "false";
    public ICollection<User> Users { get; set; } // Relación con usuarios
    public ICollection<TaskItem> TaskItems { get; set; } // Relación con tareas
    public ICollection<Location> Locations { get; set; } // Relación con ubicaciones
}