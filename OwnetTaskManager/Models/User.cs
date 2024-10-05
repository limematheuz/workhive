namespace OwnetTaskManager.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; }
    public string PasswordHash { get; set; }
    
    // Relación con la empresa
    public int CompanyId { get; set; }
    public Company Company { get; set; }
    
    // Relación con el rol
    public int RoleId { get; set; }
    public Role Role { get; set; } // Relación con la entidad Role
    
    public ICollection<Task> Tasks { get; set; } // Relación con tareas asignadas
}

