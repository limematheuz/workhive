using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace OwnetTaskManager.Models;

public class User
{
    [Key]
    public int Id { get; set; }
    public string Username { get; set; }
    public string PasswordHash { get; set; }
    
    // Relación con la empresa
    public int CompanyId { get; set; }
    [JsonIgnore]
    public Company Company { get; set; }
    
    // Relación con el rol
    public int RoleId { get; set; }
    [JsonIgnore]
    public Role Role { get; set; } // Relación con la entidad Role
    
    [JsonIgnore]
    public ICollection<TaskItem> TaskItems { get; set; } // Relación con tareas asignadas
}

