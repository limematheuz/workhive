namespace OwnetTaskManager.Models;

public class Role
{
    public int Id { get; set; }
    public string Name { get; set; } // Nombre del rol, por ejemplo: Admin, User, etc.
    public ICollection<User> Users { get; set; } // Relación con usuarios que tienen
}