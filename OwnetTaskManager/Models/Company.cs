using System.ComponentModel.DataAnnotations;

namespace OwnetTaskManager.Models;

public class Company
{
    [Key]
    public int Id { get; set; }
    public string Name { get; set; }
    public string Phone { get; set; }
    public string Email { get; set; }
    public string Website { get; set; }
    public string Logo { get; set; }
    public string Status { get; set; }
    public string IsDeleted { get; set; }

    public ICollection<User> Users { get; set; } // Relación con usuarios
    public ICollection<TaskItem> TaskItems { get; set; } // Relación con tareas
    public ICollection<Location> Locations { get; set; } // Relación con ubicaciones
}